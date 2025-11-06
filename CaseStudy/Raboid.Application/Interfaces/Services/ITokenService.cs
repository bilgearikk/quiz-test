using Raboid.Domain.Entities;

namespace Raboid.Application.Interfaces.Services
{
    public interface ITokenService
    {
        string CreateToken(RpaClient client);
    }
}