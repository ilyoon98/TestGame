using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class GameWindowCapture
{
    [StructLayout(LayoutKind.Sequential)]
    private struct Rect
    {
        public int Left, Top, Right, Bottom;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct Point
    {
        public int X, Y;
    }

    [DllImport("user32.dll")]
    private static extern bool IsWindow(IntPtr window);
    [DllImport("user32.dll")]
    private static extern bool IsIconic(IntPtr window);
    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr window);
    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
    [DllImport("user32.dll")]
    private static extern bool GetClientRect(IntPtr window, out Rect rect);
    [DllImport("user32.dll")]
    private static extern bool ClientToScreen(IntPtr window, ref Point point);
    [DllImport("user32.dll")]
    private static extern bool PrintWindow(IntPtr window, IntPtr destination, uint flags);
    [DllImport("user32.dll")]
    private static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    private static extern IntPtr GetTopWindow(IntPtr parent);
    [DllImport("user32.dll")]
    private static extern IntPtr GetWindow(IntPtr window, uint command);
    [DllImport("user32.dll")]
    private static extern bool GetWindowRect(IntPtr window, out Rect rect);
    [DllImport("dwmapi.dll")]
    private static extern int DwmGetWindowAttribute(IntPtr window, int attribute, out int value, int size);

    public static Bitmap Read(IntPtr window, uint processId, out string status)
    {
        status = "closed";
        if (!IsWindow(window)) return null;
        uint owner;
        if (processId != 0 && (GetWindowThreadProcessId(window, out owner) == 0 || owner != processId))
        {
            return null;
        }

        status = "hidden";
        if (IsIconic(window) || !IsWindowVisible(window)) return null;

        IntPtr previousDpi = SetThreadDpiAwarenessContext(new IntPtr(-4));
        try
        {
            Rect client;
            if (!GetClientRect(window, out client) || client.Right < 640 || client.Bottom < 320)
            {
                status = "small";
                return null;
            }

            Bitmap bitmap = new Bitmap(client.Right, client.Bottom, PixelFormat.Format32bppRgb);
            try
            {
                if (RenderWindow(window, bitmap) && HasContent(bitmap)) return bitmap;
                if (CopyVisibleClient(window, bitmap) && HasContent(bitmap)) return bitmap;
                status = "unavailable";
            }
            catch
            {
                bitmap.Dispose();
                throw;
            }

            bitmap.Dispose();
            return null;
        }
        finally
        {
            if (previousDpi != IntPtr.Zero) SetThreadDpiAwarenessContext(previousDpi);
        }
    }

    private static bool RenderWindow(IntPtr window, Bitmap bitmap)
    {
        using (Graphics graphics = Graphics.FromImage(bitmap))
        {
            IntPtr context = graphics.GetHdc();
            try
            {
                // PW_CLIENTONLY | PW_RENDERFULLCONTENT
                return PrintWindow(window, context, 3);
            }
            finally
            {
                graphics.ReleaseHdc(context);
            }
        }
    }

    private static bool CopyVisibleClient(IntPtr window, Bitmap bitmap)
    {
        Point origin = new Point();
        if (!ClientToScreen(window, ref origin)) return false;
        Rectangle client = new Rectangle(origin.X, origin.Y, bitmap.Width, bitmap.Height);
        if (!IsUncovered(window, client)) return false;
        using (Graphics graphics = Graphics.FromImage(bitmap))
        {
            graphics.CopyFromScreen(origin.X, origin.Y, 0, 0, client.Size, CopyPixelOperation.SourceCopy);
        }
        return IsUncovered(window, client);
    }

    private static bool IsUncovered(IntPtr window, Rectangle client)
    {
        if (GetForegroundWindow() != window) return false;
        IntPtr above = GetTopWindow(IntPtr.Zero);
        for (int i = 0; above != IntPtr.Zero && i < 2048; i++, above = GetWindow(above, 2))
        {
            if (above == window) return true;
            Rect bounds;
            int cloaked;
            if (IsWindowVisible(above) && !IsIconic(above) &&
                (DwmGetWindowAttribute(above, 14, out cloaked, sizeof(int)) != 0 || cloaked == 0) &&
                GetWindowRect(above, out bounds) &&
                client.IntersectsWith(Rectangle.FromLTRB(bounds.Left, bounds.Top, bounds.Right, bounds.Bottom)))
            {
                return false;
            }
        }
        return false;
    }

    private static bool HasContent(Bitmap bitmap)
    {
        for (int row = 1; row < 12; row++)
        {
            for (int column = 1; column < 16; column++)
            {
                Color pixel = bitmap.GetPixel(column * bitmap.Width / 16, row * bitmap.Height / 12);
                if (Math.Max(pixel.R, Math.Max(pixel.G, pixel.B)) > 24) return true;
            }
        }
        return false;
    }
}
