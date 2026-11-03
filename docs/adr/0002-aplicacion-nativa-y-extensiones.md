# Native Application Coordinated with Browser Extensions

The product needs to block specific paths within an allowed site and show a Windows screen when an attempt occurs. Each browser applies the rule before loading the page and notifies a native supervisor through local communication. This avoids inspecting HTTPS traffic outside the browser and allows browsers to share one timer state. The tradeoff is maintaining and verifying an integration for Chrome, Brave, Edge, Firefox, and every included Opera variant.

The lock screen presentation was superseded by [ADR 0004](./0004-bloqueo-sobre-navegadores.md). Coordination between the extensions and native application remains in effect.
