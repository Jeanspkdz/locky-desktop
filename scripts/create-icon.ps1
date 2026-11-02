$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$assetDir = Join-Path $root 'assets'
$svgPath = Join-Path $assetDir 'locky.svg'
$pngPath = Join-Path $assetDir 'locky.png'
$icoPath = Join-Path $assetDir 'locky.ico'

if (-not (Test-Path -LiteralPath $svgPath)) {
  throw "No se encontró el icono SVG: $svgPath"
}

Add-Type -ReferencedAssemblies System.Drawing,System.Xml,System.Core -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Globalization;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;
using System.Xml;

public static class LockyIconRenderer {
  static readonly Color CyanStart = ColorTranslator.FromHtml("#19f5ff");
  static readonly Color CyanEnd = ColorTranslator.FromHtml("#00c8dd");

  static string Inherited(XmlElement element, string name, string fallback) {
    for (XmlElement current = element; current != null; current = current.ParentNode as XmlElement) {
      if (current.HasAttribute(name)) return current.GetAttribute(name);
      if (current.LocalName == "svg") break;
    }
    return fallback;
  }

  static bool IsInDefs(XmlElement element) {
    for (XmlElement current = element; current != null; current = current.ParentNode as XmlElement)
      if (current.LocalName == "defs") return true;
    return false;
  }

  static float Number(string value, float fallback) {
    float result;
    return float.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out result) ? result : fallback;
  }

  static float ReadNumber(System.Collections.Generic.List<string> tokens, ref int index) {
    if (index >= tokens.Count || (tokens[index].Length == 1 && char.IsLetter(tokens[index][0])))
      throw new FormatException("Unexpected end of SVG path.");
    return float.Parse(tokens[index++], CultureInfo.InvariantCulture);
  }

  static GraphicsPath ParsePath(string data) {
    var tokens = Regex.Matches(data, @"[A-Za-z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?")
      .Cast<Match>().Select(match => match.Value).ToList();
    var path = new GraphicsPath(FillMode.Winding);
    char command = '\0';
    bool newSubpath = false;
    PointF current = new PointF(0, 0);
    PointF subpathStart = current;
    int index = 0;

    while (index < tokens.Count) {
      if (tokens[index].Length == 1 && char.IsLetter(tokens[index][0])) {
        command = tokens[index++][0];
        if (command == 'Z' || command == 'z') {
          path.CloseFigure();
          current = subpathStart;
          command = '\0';
        } else if (command == 'M' || command == 'm') {
          newSubpath = true;
        }
        continue;
      }

      if (command == '\0') throw new FormatException("SVG path data is missing a command.");
      bool relative = char.IsLower(command);
      char op = char.ToUpperInvariant(command);
      if (op == 'M' || op == 'L') {
        float x = ReadNumber(tokens, ref index);
        float y = ReadNumber(tokens, ref index);
        PointF point = relative ? new PointF(current.X + x, current.Y + y) : new PointF(x, y);
        if (op == 'M' && newSubpath) {
          path.StartFigure();
          subpathStart = point;
          newSubpath = false;
        } else {
          path.AddLine(current, point);
        }
        current = point;
        if (op == 'M') command = relative ? 'l' : 'L';
      } else if (op == 'H') {
        float x = ReadNumber(tokens, ref index);
        PointF point = new PointF(relative ? current.X + x : x, current.Y);
        path.AddLine(current, point);
        current = point;
      } else if (op == 'V') {
        float y = ReadNumber(tokens, ref index);
        PointF point = new PointF(current.X, relative ? current.Y + y : y);
        path.AddLine(current, point);
        current = point;
      } else if (op == 'C') {
        float x1 = ReadNumber(tokens, ref index), y1 = ReadNumber(tokens, ref index);
        float x2 = ReadNumber(tokens, ref index), y2 = ReadNumber(tokens, ref index);
        float x = ReadNumber(tokens, ref index), y = ReadNumber(tokens, ref index);
        if (relative) {
          x1 += current.X; y1 += current.Y;
          x2 += current.X; y2 += current.Y;
          x += current.X; y += current.Y;
        }
        path.AddBezier(current, new PointF(x1, y1), new PointF(x2, y2), new PointF(x, y));
        current = new PointF(x, y);
      } else {
        throw new NotSupportedException("Unsupported SVG path command: " + command);
      }
    }
    return path;
  }

  static GraphicsPath RoundedRectangle(float x, float y, float width, float height, float radius) {
    var path = new GraphicsPath(FillMode.Winding);
    float diameter = Math.Min(radius * 2, Math.Min(width, height));
    path.AddArc(x, y, diameter, diameter, 180, 90);
    path.AddArc(x + width - diameter, y, diameter, diameter, 270, 90);
    path.AddArc(x + width - diameter, y + height - diameter, diameter, diameter, 0, 90);
    path.AddArc(x, y + height - diameter, diameter, diameter, 90, 90);
    path.CloseFigure();
    return path;
  }

  static RectangleF SafeBounds(GraphicsPath path) {
    RectangleF bounds = path.GetBounds();
    if (bounds.Width < 1) bounds.Width = 1;
    if (bounds.Height < 1) bounds.Height = 1;
    return bounds;
  }

  static Brush PaintBrush(string paint, RectangleF bounds) {
    if (paint.Contains("#tile")) {
      var brush = new LinearGradientBrush(
        new PointF(bounds.Left, bounds.Top), new PointF(bounds.Right, bounds.Bottom),
        ColorTranslator.FromHtml("#10161c"), ColorTranslator.FromHtml("#03060a"));
      var blend = new ColorBlend(3);
      blend.Colors = new[] { ColorTranslator.FromHtml("#10161c"), ColorTranslator.FromHtml("#070c12"), ColorTranslator.FromHtml("#03060a") };
      blend.Positions = new[] { 0f, 0.56f, 1f };
      brush.InterpolationColors = blend;
      return brush;
    }
    if (paint.Contains("#cyan"))
      return new LinearGradientBrush(
        new PointF(bounds.Left, bounds.Top), new PointF(bounds.Left + bounds.Width * 0.85f, bounds.Bottom),
        CyanStart, CyanEnd);
    return new SolidBrush(ColorTranslator.FromHtml(paint));
  }

  static LineCap Cap(string value) {
    return value == "round" ? LineCap.Round : value == "square" ? LineCap.Square : LineCap.Flat;
  }

  static LineJoin Join(string value) {
    return value == "round" ? LineJoin.Round : value == "bevel" ? LineJoin.Bevel : LineJoin.Miter;
  }

  static void DrawShape(Graphics graphics, GraphicsPath path, string fill, string stroke, float strokeWidth, string lineCap, string lineJoin) {
    RectangleF bounds = SafeBounds(path);
    LineCap cap = Cap(lineCap);
    LineJoin join = Join(lineJoin);

    if (fill != "none") {
      using (Brush brush = PaintBrush(fill, bounds)) graphics.FillPath(brush, path);
    }

    if (stroke != "none") {
      using (Brush brush = PaintBrush(stroke, bounds))
      using (var pen = new Pen(brush, Math.Max(strokeWidth, 1))) {
        pen.StartCap = cap;
        pen.EndCap = cap;
        pen.LineJoin = join;
        graphics.DrawPath(pen, path);
      }
    }
  }

  static byte Clamp(float value) {
    return (byte)Math.Max(0, Math.Min(255, (int)Math.Round(value)));
  }

  static float[] BlurChannel(float[] input, int width, int height, float[] kernel, int radius, bool horizontal) {
    var output = new float[input.Length];
    if (horizontal) {
      for (int y = 0; y < height; y++) {
        int row = y * width;
        for (int x = 0; x < width; x++) {
          float value = 0;
          for (int k = -radius; k <= radius; k++) {
            int sampleX = x + k;
            if (sampleX >= 0 && sampleX < width) value += input[row + sampleX] * kernel[k + radius];
          }
          output[row + x] = value;
        }
      }
    } else {
      for (int y = 0; y < height; y++) {
        for (int x = 0; x < width; x++) {
          float value = 0;
          for (int k = -radius; k <= radius; k++) {
            int sampleY = y + k;
            if (sampleY >= 0 && sampleY < height) value += input[sampleY * width + x] * kernel[k + radius];
          }
          output[y * width + x] = value;
        }
      }
    }
    return output;
  }

  static void GaussianBlur(Bitmap bitmap, float sigma) {
    int width = bitmap.Width, height = bitmap.Height;
    int radius = (int)Math.Ceiling(sigma * 3);
    var kernel = new float[radius * 2 + 1];
    float sum = 0;
    for (int i = -radius; i <= radius; i++) {
      float weight = (float)Math.Exp(-(i * i) / (2 * sigma * sigma));
      kernel[i + radius] = weight;
      sum += weight;
    }
    for (int i = 0; i < kernel.Length; i++) kernel[i] /= sum;

    var rect = new Rectangle(0, 0, width, height);
    BitmapData data = bitmap.LockBits(rect, ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
    try {
      int length = width * height;
      var bytes = new byte[Math.Abs(data.Stride) * height];
      Marshal.Copy(data.Scan0, bytes, 0, bytes.Length);
      var channels = new float[4][];
      for (int c = 0; c < 4; c++) channels[c] = new float[length];
      for (int i = 0; i < length; i++) {
        int p = i * 4;
        float alpha = bytes[p + 3] / 255f;
        channels[0][i] = bytes[p] * alpha;
        channels[1][i] = bytes[p + 1] * alpha;
        channels[2][i] = bytes[p + 2] * alpha;
        channels[3][i] = bytes[p + 3];
      }
      for (int c = 0; c < 4; c++) {
        float[] horizontal = BlurChannel(channels[c], width, height, kernel, radius, true);
        channels[c] = BlurChannel(horizontal, width, height, kernel, radius, false);
      }
      for (int i = 0; i < length; i++) {
        int p = i * 4;
        float alpha = channels[3][i];
        if (alpha <= 0.01f) {
          bytes[p] = bytes[p + 1] = bytes[p + 2] = bytes[p + 3] = 0;
        } else {
          bytes[p] = Clamp(channels[0][i] * 255f / alpha);
          bytes[p + 1] = Clamp(channels[1][i] * 255f / alpha);
          bytes[p + 2] = Clamp(channels[2][i] * 255f / alpha);
          bytes[p + 3] = Clamp(alpha);
        }
      }
      Marshal.Copy(bytes, 0, data.Scan0, bytes.Length);
    } finally {
      bitmap.UnlockBits(data);
    }
  }

  static void TintGlow(Bitmap bitmap, float alphaScale) {
    var rect = new Rectangle(0, 0, bitmap.Width, bitmap.Height);
    BitmapData data = bitmap.LockBits(rect, ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
    try {
      int length = Math.Abs(data.Stride) * bitmap.Height;
      var bytes = new byte[length];
      Marshal.Copy(data.Scan0, bytes, 0, length);
      for (int p = 0; p < length; p += 4) {
        bytes[p] = 245;
        bytes[p + 1] = 212;
        bytes[p + 2] = 0;
        bytes[p + 3] = Clamp(bytes[p + 3] * alphaScale);
      }
      Marshal.Copy(bytes, 0, data.Scan0, length);
    } finally {
      bitmap.UnlockBits(data);
    }
  }

  static void RenderNode(Graphics graphics, XmlElement element) {
    if (element.LocalName == "defs") return;
    GraphicsPath path = null;
    if (element.LocalName == "path") {
      path = ParsePath(element.GetAttribute("d"));
    } else if (element.LocalName == "rect") {
      float x = Number(element.GetAttribute("x"), 0);
      float y = Number(element.GetAttribute("y"), 0);
      float width = Number(element.GetAttribute("width"), 0);
      float height = Number(element.GetAttribute("height"), 0);
      float radius = Number(element.GetAttribute("rx"), 0);
      path = radius > 0 ? RoundedRectangle(x, y, width, height, radius) : new GraphicsPath();
      if (radius <= 0) path.AddRectangle(new RectangleF(x, y, width, height));
    }

    if (path != null) {
      using (path) {
        string fill = Inherited(element, "fill", "black");
        string stroke = Inherited(element, "stroke", "none");
        float strokeWidth = Number(Inherited(element, "stroke-width", "1"), 1);
        string lineCap = Inherited(element, "stroke-linecap", "butt");
        string lineJoin = Inherited(element, "stroke-linejoin", "miter");
        DrawShape(graphics, path, fill, stroke, strokeWidth, lineCap, lineJoin);
      }
    }

    foreach (XmlNode child in element.ChildNodes) {
      var childElement = child as XmlElement;
      if (childElement != null) RenderNode(graphics, childElement);
    }
  }

  static void RenderFilteredGroup(Graphics graphics, XmlElement element, XmlDocument document) {
    string filter = Inherited(element, "filter", "");
    Match match = Regex.Match(filter, @"#([A-Za-z0-9_-]+)");
    if (!match.Success) {
      RenderNode(graphics, element);
      return;
    }
    string id = match.Groups[1].Value;
    XmlElement definition = document.SelectSingleNode("//*[@id='" + id + "']") as XmlElement;
    XmlElement blur = definition == null ? null : definition.SelectSingleNode(".//*[local-name()='feGaussianBlur']") as XmlElement;
    float sigma = blur == null ? 0 : Number(blur.GetAttribute("stdDeviation"), 0);
    if (sigma > 0) {
      using (var layer = new Bitmap(512, 512, PixelFormat.Format32bppArgb))
      using (Graphics layerGraphics = Graphics.FromImage(layer)) {
        layerGraphics.Clear(Color.Transparent);
        layerGraphics.SmoothingMode = SmoothingMode.AntiAlias;
        layerGraphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
        layerGraphics.CompositingQuality = CompositingQuality.HighQuality;
        RenderNode(layerGraphics, element);
        GaussianBlur(layer, sigma);
        if (id == "glow") TintGlow(layer, 0.82f);
        graphics.DrawImageUnscaled(layer, 0, 0);
      }
    }
    RenderNode(graphics, element);
  }

  public static void Render(string svgPath, string pngPath) {
    var document = new XmlDocument();
    document.XmlResolver = null;
    document.Load(svgPath);
    var root = document.DocumentElement;
    using (var source = new Bitmap(512, 512, PixelFormat.Format32bppArgb))
    using (Graphics graphics = Graphics.FromImage(source)) {
      graphics.Clear(Color.Transparent);
      graphics.SmoothingMode = SmoothingMode.AntiAlias;
      graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
      graphics.CompositingQuality = CompositingQuality.HighQuality;
      foreach (XmlNode node in root.ChildNodes) {
        var element = node as XmlElement;
        if (element == null || IsInDefs(element)) continue;
        RenderFilteredGroup(graphics, element, document);
      }
      using (var output = new Bitmap(256, 256, PixelFormat.Format32bppArgb))
      using (Graphics resize = Graphics.FromImage(output)) {
        resize.Clear(Color.Transparent);
        resize.InterpolationMode = InterpolationMode.HighQualityBicubic;
        resize.SmoothingMode = SmoothingMode.HighQuality;
        resize.PixelOffsetMode = PixelOffsetMode.HighQuality;
        resize.DrawImage(source, new Rectangle(0, 0, 256, 256), new Rectangle(0, 0, 512, 512), GraphicsUnit.Pixel);
        output.Save(pngPath, ImageFormat.Png);
      }
    }
  }
}
'@

[LockyIconRenderer]::Render($svgPath, $pngPath)
$png = [System.IO.File]::ReadAllBytes($pngPath)
$stream = [System.IO.File]::Create($icoPath)
$writer = [System.IO.BinaryWriter]::new($stream)
try {
  $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]1)
  $writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([byte]0)
  $writer.Write([uint16]1); $writer.Write([uint16]32)
  $writer.Write([uint32]$png.Length); $writer.Write([uint32]22)
  $writer.Write($png)
} finally {
  $writer.Dispose()
}
Write-Output "Iconos creados desde locky.svg: $pngPath y $icoPath"
