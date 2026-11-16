using System;
using System.Diagnostics;
using System.IO;
using System.Net.NetworkInformation;
using System.ServiceProcess;
using System.Threading;
using Microsoft.Win32;
using Microsoft.Win32.SafeHandles;

namespace Locky.DnsProtection {
  public sealed class ProtectionService : ServiceBase {
    [System.Runtime.InteropServices.DllImport("advapi32.dll", SetLastError = true)]
    private static extern int RegNotifyChangeKeyValue(IntPtr key, bool watchSubtree, uint filter, IntPtr eventHandle, bool asynchronous);
    private Timer backup;
    private readonly object repairGate = new object();
    private string repairScript;
    private string configPath;

    public ProtectionService() {
      ServiceName = "LockyDnsProtection";
      CanStop = true;
      AutoLog = false;
    }

    protected override void OnStart(string[] args) {
      string root = AppDomain.CurrentDomain.BaseDirectory;
      repairScript = Path.Combine(root, "Repair-Protection.ps1");
      configPath = Path.Combine(root, "protection.json");
      NetworkChange.NetworkAddressChanged += OnNetworkChanged;
      backup = new Timer(_ => Repair("backup"), null, TimeSpan.Zero, TimeSpan.FromSeconds(45));
      WatchRegistry("SOFTWARE\\Policies\\Google");
      WatchRegistry("SOFTWARE\\Policies\\BraveSoftware");
      WatchRegistry("SOFTWARE\\Policies\\Microsoft\\Edge");
      WatchRegistry("SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces");
      WatchRegistry("SYSTEM\\CurrentControlSet\\Services\\SharedAccess\\Parameters\\FirewallPolicy");
    }

    private void OnNetworkChanged(object sender, EventArgs args) { Repair("network-change"); }

    private void WatchRegistry(string subkey) {
      Thread thread = new Thread(() => {
        while (!CancellationPending) {
          try {
            using (RegistryKey key = Registry.LocalMachine.OpenSubKey(subkey, false)) {
              if (key == null) { Thread.Sleep(TimeSpan.FromSeconds(5)); continue; }
              SafeRegistryHandle handle = key.Handle;
              int result = RegNotifyChangeKeyValue(handle.DangerousGetHandle(), true, 0x00000001 | 0x00000004, IntPtr.Zero, false);
              if (result == 0 && !CancellationPending) Repair("registry-change:" + subkey);
              else if (result != 0 && !CancellationPending) Thread.Sleep(TimeSpan.FromSeconds(5));
            }
          } catch {
            if (!CancellationPending) Thread.Sleep(TimeSpan.FromSeconds(5));
          }
        }
      });
      thread.IsBackground = true;
      thread.Start();
    }

    private volatile bool stopping;
    private bool CancellationPending { get { return stopping; } }

    private void Log(string message) {
      try {
        string log = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "Locky\\Protection\\protection.log");
        File.AppendAllText(log, DateTime.UtcNow.ToString("o") + " " + message + Environment.NewLine);
      } catch { }
    }

    private void Repair(string reason) {
      if (stopping || !Monitor.TryEnter(repairGate)) return;
      try {
        ProcessStartInfo start = new ProcessStartInfo {
          FileName = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.System), "WindowsPowerShell\\v1.0\\powershell.exe"),
          Arguments = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File \"" + repairScript + "\" -ConfigPath \"" + configPath + "\"",
          UseShellExecute = false,
          CreateNoWindow = true,
          WindowStyle = ProcessWindowStyle.Hidden
        };
        using (Process process = Process.Start(start)) {
          if (process != null && !process.WaitForExit(30000)) process.Kill();
        }
      } catch (Exception error) {
        Log("Service repair failed (" + reason + "): " + error.Message);
      } finally { Monitor.Exit(repairGate); }
    }

    protected override void OnStop() {
      Log("Service stop requested.");
      stopping = true;
      NetworkChange.NetworkAddressChanged -= OnNetworkChanged;
      if (backup != null) backup.Dispose();
    }

    public static void Main() { ServiceBase.Run(new ProtectionService()); }
  }
}
