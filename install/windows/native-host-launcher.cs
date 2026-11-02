using System;
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Win32;

internal static class LockyNativeHost
{
    private const int MaxMessageBytes = 1024 * 1024;
    private const string DefaultPipeName = "locky-desktop";
    private static readonly Encoding Utf8 = new UTF8Encoding(false);

    public static int Main(string[] args)
    {
        string appExecutable;
        string appRoot;
        using (RegistryKey key = Registry.CurrentUser.OpenSubKey(@"Software\LockyDesktop\NativeHost"))
        {
            if (key == null) return Fail("Locky setup is missing. Run pnpm setup:dev.");
            appExecutable = key.GetValue("AppExecutable") as string;
            appRoot = key.GetValue("AppRoot") as string;
        }

        if (String.IsNullOrWhiteSpace(appExecutable) || !File.Exists(appExecutable)
            || String.IsNullOrWhiteSpace(appRoot) || !Directory.Exists(appRoot))
            return Fail("Locky setup points to an unavailable application folder.");
        Trace("Native host ready.");
        string pipeName = GetPipeName();
        Thread monitor = new Thread(delegate() { MonitorDesktopPipe(pipeName); });
        monitor.IsBackground = true;
        monitor.Start();

        Stream input = Console.OpenStandardInput();
        Stream output = Console.OpenStandardOutput();
        byte[] header = new byte[4];
        while (ReadHeader(input, header))
        {
            int messageLength = BitConverter.ToInt32(header, 0);
            if (messageLength < 0 || messageLength > MaxMessageBytes)
                return Fail("Native messaging request is outside the supported size.");

            byte[] message = new byte[messageLength];
            if (!ReadExactly(input, message, messageLength))
                return Fail("Native messaging request ended before its payload.");
            Trace("Received request bytes: " + messageLength);

            string response;
            try
            {
                response = SendToDesktop(Utf8.GetString(message), appExecutable, appRoot, pipeName);
            }
            catch (Exception error)
            {
                return Fail(error.Message);
            }

            byte[] responseBytes = Utf8.GetBytes(response);
            if (responseBytes.Length > MaxMessageBytes)
                return Fail("Locky response is outside the supported size.");
            output.Write(BitConverter.GetBytes(responseBytes.Length), 0, 4);
            output.Write(responseBytes, 0, responseBytes.Length);
            output.Flush();
        }

        return 0;
    }

    private static void MonitorDesktopPipe(string pipeName)
    {
        while (true)
        {
            Thread.Sleep(3000);
            try
            {
                using (NamedPipeClientStream pipe = new NamedPipeClientStream(".", pipeName, PipeDirection.InOut))
                {
                    pipe.Connect(500);
                    using (StreamReader reader = new StreamReader(pipe, Utf8, false, 1024, true))
                    using (StreamWriter writer = new StreamWriter(pipe, Utf8, 1024, true))
                    {
                        writer.WriteLine("{\"id\":\"supervisor-ping\",\"type\":\"getState\",\"offset\":0,\"limit\":0}");
                        writer.Flush();
                        Task<string> response = Task.Factory.StartNew(() => reader.ReadLine());
                        if (!response.Wait(1000) || response.Result == null
                            || response.Result.IndexOf("\"ok\":true", StringComparison.Ordinal) < 0
                            || response.Result.IndexOf("\"type\":\"state\"", StringComparison.Ordinal) < 0)
                            throw new IOException("Locky Desktop did not answer the health check.");
                    }
                }
            }
            catch
            {
                Trace("Desktop pipe is unavailable; closing native host so the browser extension can fail closed and reconnect.");
                Environment.Exit(0);
                return;
            }
        }
    }

    private static string SendToDesktop(string message, string appExecutable, string appRoot, string pipeName)
    {
        Exception lastError = null;
        for (int attempt = 0; attempt < 40; attempt++)
        {
            using (NamedPipeClientStream pipe = new NamedPipeClientStream(".", pipeName, PipeDirection.InOut))
            {
                try
                {
                    pipe.Connect(250);
                    Trace("Connected to the desktop pipe.");
                    using (StreamReader reader = new StreamReader(pipe, Utf8, false, 1024, true))
                    using (StreamWriter writer = new StreamWriter(pipe, Utf8, 1024, true))
                    {
                        writer.WriteLine(message);
                        writer.Flush();
                        Trace("Forwarded request to the desktop.");
                        string response = reader.ReadLine();
                        if (response == null) throw new IOException("Locky Desktop closed the local connection.");
                        Trace("Received desktop response.");
                        return response;
                    }
                }
                catch (Exception error)
                {
                    lastError = error;
                }
            }

            if (attempt == 0) StartDesktop(appExecutable, appRoot);
            Thread.Sleep(250);
        }

        throw new IOException("Locky Desktop did not answer the browser request.", lastError);
    }

    private static string GetPipeName()
    {
        if (Environment.GetEnvironmentVariable("LOCKY_TEST_MODE") == "1")
        {
            string testPipeName = Environment.GetEnvironmentVariable("LOCKY_TEST_PIPE_NAME");
            if (!String.IsNullOrWhiteSpace(testPipeName) && testPipeName.Length <= 80)
            {
                foreach (char character in testPipeName)
                    if (!Char.IsLetterOrDigit(character) && character != '-' && character != '_')
                        return DefaultPipeName;
                return testPipeName;
            }
        }
        return DefaultPipeName;
    }

    private static void StartDesktop(string appExecutable, string appRoot)
    {
        ProcessStartInfo start = new ProcessStartInfo();
        start.FileName = appExecutable;
        start.Arguments = Quote(appRoot) + " --background";
        start.WorkingDirectory = appRoot;
        start.UseShellExecute = false;
        start.CreateNoWindow = true;
        Process.Start(start);
    }

    private static bool ReadHeader(Stream input, byte[] header)
    {
        int first = input.ReadByte();
        if (first < 0) return false;
        header[0] = (byte)first;
        return ReadExactly(input, header, 4, 1);
    }

    private static bool ReadExactly(Stream input, byte[] buffer, int length, int offset = 0)
    {
        while (offset < length)
        {
            int read = input.Read(buffer, offset, length - offset);
            if (read == 0) return false;
            offset += read;
        }
        return true;
    }

    private static int Fail(string message)
    {
        Console.Error.WriteLine("Locky native host: " + message);
        return 1;
    }

    private static void Trace(string message)
    {
        if (Environment.GetEnvironmentVariable("LOCKY_NATIVE_HOST_TRACE") == "1")
            Console.Error.WriteLine("Locky native host: " + message);
    }

    private static string Quote(string value)
    {
        return "\"" + value.Replace("\"", "\\\"") + "\"";
    }
}
