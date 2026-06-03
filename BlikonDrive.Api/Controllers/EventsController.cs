using BlikonDrive.Api.Services;
using Microsoft.AspNetCore.Mvc;
using System.Text.Json;

namespace BlikonDrive.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class EventsController(FileEventService events) : ControllerBase
{
    // GET /api/events/files?coreFolderId=folder-test-001
    [HttpGet("files")]
    public async Task StreamFiles([FromQuery] string coreFolderId, CancellationToken ct)
    {
        Response.Headers.Append("Content-Type", "text/event-stream");
        Response.Headers.Append("Cache-Control", "no-cache");
        Response.Headers.Append("X-Accel-Buffering", "no");
        Response.Headers.Append("Connection", "keep-alive");

        // Enviar headers y confirmar conexión inmediatamente
        await Response.StartAsync(ct);
        await Response.WriteAsync(": connected\n\n", ct);
        await Response.Body.FlushAsync(ct);

        var channel = events.Subscribe();
        try
        {
            var serializer = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

            while (!ct.IsCancellationRequested)
            {
                // Esperar evento con timeout de 20s — si no llega, mandar heartbeat
                using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
                cts.CancelAfter(TimeSpan.FromSeconds(20));

                try
                {
                    var evt = await channel.Reader.ReadAsync(cts.Token);

                    if (evt.CoreFolderId == coreFolderId)
                    {
                        var json = JsonSerializer.Serialize(evt, serializer);
                        await Response.WriteAsync($"data: {json}\n\n", ct);
                        await Response.Body.FlushAsync(ct);
                    }
                }
                catch (OperationCanceledException) when (!ct.IsCancellationRequested)
                {
                    // Timeout de 20s → heartbeat para mantener la conexión viva
                    await Response.WriteAsync(": ping\n\n", ct);
                    await Response.Body.FlushAsync(ct);
                }
            }
        }
        catch (OperationCanceledException) { }
        finally
        {
            events.Unsubscribe(channel);
        }
    }
}
