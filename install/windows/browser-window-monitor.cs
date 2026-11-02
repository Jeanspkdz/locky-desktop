using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

internal static class BrowserWindowMonitor
{
    private delegate bool EnumWindowsCallback(IntPtr hwnd, IntPtr parameter);
    private const int MaxTitleLength = 512;
    private const int GwlpHwndParent = -8;
    private const uint SwpNoSize = 0x0001;
    private const uint SwpNoMove = 0x0002;
    private const uint SwpNoActivate = 0x0010;
    private const uint SwpShowWindow = 0x0040;

    [StructLayout(LayoutKind.Sequential)]
    private struct Rect { public int Left, Top, Right, Bottom; }

    [DllImport("user32.dll")] private static extern bool EnumWindows(EnumWindowsCallback callback, IntPtr parameter);
    [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr hwnd);
    [DllImport("user32.dll")] private static extern bool IsIconic(IntPtr hwnd);
    [DllImport("user32.dll")] private static extern bool GetWindowRect(IntPtr hwnd, out Rect rect);
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint processId);
    [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetWindowText(IntPtr hwnd, StringBuilder text, int count);
    [DllImport("user32.dll", EntryPoint = "SetWindowLongPtrW", SetLastError = true)] private static extern IntPtr SetWindowLongPtr(IntPtr hwnd, int index, IntPtr value);
    [DllImport("user32.dll", SetLastError = true)] private static extern bool SetWindowPos(IntPtr hwnd, IntPtr insertAfter, int x, int y, int width, int height, uint flags);
    [DllImport("user32.dll")] private static extern IntPtr GetWindow(IntPtr hwnd, uint command);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetClassName(IntPtr hwnd, StringBuilder className, int count);
    private const uint GwOwner = 4;

    public static int Main(string[] args)
    {
        if (args.Length == 3 && args[0] == "--attach")
            return AttachOverlay(args);

        IntPtr foreground = GetForegroundWindow();
        List<string> entries = new List<string>();
        EnumWindows(delegate(IntPtr hwnd, IntPtr ignored)
        {
            if (!IsWindowVisible(hwnd) && !IsIconic(hwnd)) return true;
            StringBuilder className = new StringBuilder(128);
            GetClassName(hwnd, className, className.Capacity);
            if (className.ToString() != "Chrome_WidgetWin_1") return true;

            uint processId;
            GetWindowThreadProcessId(hwnd, out processId);
            if (processId == 0) return true;
            StringBuilder title = new StringBuilder(MaxTitleLength);
            GetWindowText(hwnd, title, title.Capacity);
            string family = null;
            try { family = GetFamily(Process.GetProcessById((int)processId).ProcessName); }
            catch { /* App containers can enumerate windows without querying their processes. */ }
            if (family == null) family = GetFamilyFromTitle(title.ToString());
            if (family == null) return true;

            Rect rect;
            if (!GetWindowRect(hwnd, out rect)) return true;
            int width = Math.Max(0, rect.Right - rect.Left);
            int height = Math.Max(0, rect.Bottom - rect.Top);
            if (width == 0 || height == 0) return true;

            entries.Add("{\"id\":\"" + hwnd.ToInt64().ToString("X")
                + "\",\"family\":\"" + family
                + "\",\"x\":" + rect.Left
                + ",\"y\":" + rect.Top
                + ",\"width\":" + width
                + ",\"height\":" + height
                + ",\"visible\":" + (IsWindowVisible(hwnd) ? "true" : "false")
                + ",\"minimized\":" + (IsIconic(hwnd) ? "true" : "false")
                + ",\"foreground\":" + (hwnd == foreground ? "true" : "false")
                + ",\"title\":\"" + Escape(title.ToString()) + "\"}");
            return true;
        }, IntPtr.Zero);
        Console.WriteLine("[" + String.Join(",", entries.ToArray()) + "]");
        return 0;
    }

    private static int AttachOverlay(string[] args)
    {
        IntPtr owner = new IntPtr(Convert.ToInt64(args[1], 16));
        IntPtr overlay = new IntPtr(Convert.ToInt64(args[2], 16));
        SetWindowLongPtr(overlay, GwlpHwndParent, owner);
        if (GetWindow(overlay, GwOwner) != owner) return 1;
        uint flags = SwpNoSize | SwpNoMove | SwpNoActivate | SwpShowWindow;
        return SetWindowPos(overlay, IntPtr.Zero, 0, 0, 0, 0, flags) ? 0 : Marshal.GetLastWin32Error();
    }

    private static string GetFamily(string processName)
    {
        switch (processName.ToLowerInvariant())
        {
            case "chrome": return "chrome";
            case "brave": return "brave";
            case "msedge": return "edge";
            default: return null;
        }
    }

    private static string GetFamilyFromTitle(string title)
    {
        if (title.EndsWith(" - Google Chrome", StringComparison.OrdinalIgnoreCase)) return "chrome";
        if (title.EndsWith(" - Brave", StringComparison.OrdinalIgnoreCase)) return "brave";
        if (title.EndsWith(" - Microsoft Edge", StringComparison.OrdinalIgnoreCase)) return "edge";
        return null;
    }

    private static string Escape(string value)
    {
        return value.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", "\\r").Replace("\n", "\\n");
    }
}
