using Microsoft.AspNetCore.Mvc;
using Raboid.Application.Interfaces.Persistence;
using Raboid.Application.Interfaces.Services;

namespace Raboid.Api.Controllers
{
    public class AuthRequest
    {
        public string ClientId { get; set; }
        public string ClientSecret { get; set; }
    }

    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly IRpaClientRepository _clientRepository;
        private readonly ITokenService _tokenService;

        public AuthController(IRpaClientRepository clientRepository, ITokenService tokenService)
        {
            _clientRepository = clientRepository;
            _tokenService = tokenService;
        }

        [HttpPost("login")]
        public async Task<ActionResult<string>> Login(AuthRequest request)
        {
            var client = await _clientRepository.GetClientByCredentialsAsync(
                request.ClientId, request.ClientSecret);

            if (client == null)
            {
                return Unauthorized("Geçersiz Client ID veya Secret.");
            }
            
            var token = _tokenService.CreateToken(client);

            // Windows Login süresi (~1 dk) boyunca durumu LoggingIn yapıyoruz.
            await _clientRepository.UpdateLoginStatusAsync(client.ClientId, "LoggingIn", Guid.NewGuid().ToString());

            return Ok(new { token = token, clientId = client.ClientId });
        }
        
        // Windows oturumu açıldıktan sonra RPA istemcisi bu endpoint'i çağıracak.
        [HttpPost("confirm-login")]
        public async Task<ActionResult> ConfirmLogin([FromQuery] string clientId)
        {
            if (string.IsNullOrEmpty(clientId)) return BadRequest();
            
            bool success = await _clientRepository.UpdateLoginStatusAsync(clientId, "LoggedIn");
            if (!success) return NotFound("Client not found or update failed.");
            
            return Ok("Login confirmed.");
        }
    }
}