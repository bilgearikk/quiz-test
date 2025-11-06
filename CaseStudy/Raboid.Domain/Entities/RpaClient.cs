using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Raboid.Domain.Entities
{
    public class RpaClient
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string Id { get; set; }
        
        public string ClientId { get; set; } // API Auth için anahtar
        public string ClientSecret { get; set; } // API Auth için sır

        public string WindowsSessionId { get; set; } 
        
        // Oturum Durumu (LoggedIn, Expired, LoggingIn)
        public string LoginStatus { get; set; } 
        
        public DateTime? LastLoginAttempt { get; set; }
        public bool IsBusy { get; set; } 
        public string CurrentJobId { get; set; } 
    }
}