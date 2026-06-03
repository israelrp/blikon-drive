using System.Threading.Channels;

namespace BlikonDrive.Api.Services;

public record FileEvent(string Type, string CoreFolderId, Guid FileId, string FileName);

public class FileEventService
{
    private readonly List<Channel<FileEvent>> _subscribers = [];
    private readonly Lock _lock = new();

    public Channel<FileEvent> Subscribe()
    {
        var ch = Channel.CreateUnbounded<FileEvent>(
            new UnboundedChannelOptions { SingleReader = true });
        lock (_lock) _subscribers.Add(ch);
        return ch;
    }

    public void Unsubscribe(Channel<FileEvent> ch)
    {
        lock (_lock) _subscribers.Remove(ch);
        ch.Writer.TryComplete();
    }

    public void Notify(FileEvent evt)
    {
        lock (_lock)
        {
            foreach (var ch in _subscribers)
                ch.Writer.TryWrite(evt);
        }
    }
}
