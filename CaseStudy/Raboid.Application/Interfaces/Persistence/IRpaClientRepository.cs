using Raboid.Domain.Entities;

namespace Raboid.Application.Interfaces.Persistence
{
    public interface IRpaClientRepository
    {
        Task<RpaClient> GetClientByCredentialsAsync(string clientId, string clientSecret);
        Task<bool> UpdateLoginStatusAsync(string clientId, string status, string sessionId = null);
        Task<bool> UpdateBusyStatusAsync(string clientId, bool isBusy, string jobId = null);
        Task<List<RpaClient>> GetAllClientsAsync();
    }
}