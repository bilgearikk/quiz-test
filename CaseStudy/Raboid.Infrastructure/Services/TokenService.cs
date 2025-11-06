using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using Raboid.Application.Interfaces.Services;
using Raboid.Domain.Entities;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace Raboid.Infrastructure.Services
{
    public class TokenService : ITokenService
    {
        private readonly SymmetricSecurityKey _key;

        public TokenService(IConfiguration config)
        {
            // TokenKey appsettings.json'dan okunacak
            _key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["TokenKey"])); 
        }

        public string CreateToken(RpaClient client)
        {
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, client.ClientId) 
            };

            var creds = new SigningCredentials(_key, SecurityAlgorithms.HmacSha512Signature);

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(claims),
                // JWT geçerlilik süresi (Örn: 7 Gün)
                Expires = DateTime.Now.AddDays(7), 
                SigningCredentials = creds
            };

            var tokenHandler = new JwtSecurityTokenHandler();
            var token = tokenHandler.CreateToken(tokenDescriptor);

            return tokenHandler.WriteToken(token);
        }
    }
}