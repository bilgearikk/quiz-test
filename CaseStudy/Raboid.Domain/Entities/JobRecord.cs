using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace Raboid.Domain.Entities
{
    public class JobRecord
    {
        [BsonId]
        [BsonRepresentation(BsonType.ObjectId)]
        public string Id { get; set; } // MongoDB _id
        
        public string StoreCode { get; set; }
        public string ProductCode { get; set; }
        public string ProductName { get; set; }

        [BsonRepresentation(BsonType.Decimal128)] // Para birimi için
        public decimal Price { get; set; }
        
        public string EanBarcode { get; set; } 

        // Durum Yönetimi (Ready, Assigned, Success, Failed, ReLoginNeeded)
        public string Status { get; set; } 
        
        public string AssignedRpaClientId { get; set; }
        public DateTime? AssignmentTime { get; set; }
        public DateTime? CompletionTime { get; set; }
        public int RetryCount { get; set; }
        public string ErrorReason { get; set; }
    }
}