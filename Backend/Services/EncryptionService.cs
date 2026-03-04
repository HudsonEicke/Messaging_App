using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using Messaging_App.Configuration;

namespace Messaging_App.Services;

public class EncryptionService
{
    private readonly byte[] key;
    private readonly byte[] iv;
    
    public EncryptionService(IOptions<EncryptionSettings> encryptionSettings)
    {
        string secretKey = encryptionSettings.Value.SecretKey;
        key = SHA256.HashData(Encoding.UTF8.GetBytes(secretKey));
        iv = MD5.HashData(Encoding.UTF8.GetBytes(secretKey));
    }

    public string Encrypt(string plainText)
    {
        byte[] encryptedText;

        using(Aes aes = Aes.Create())
        {
            aes.Key = key;
            aes.IV = iv;

            encryptedText = aes.EncryptCbc(Encoding.UTF8.GetBytes(plainText), iv);
        }

        return Convert.ToBase64String(encryptedText);
    }

    public string Decrypt(string cipherText)
    {
        byte[] decryptedText;

        using(Aes aes = Aes.Create())
        {
            aes.Key = key;
            aes.IV = iv;
            
            decryptedText = aes.DecryptCbc(Convert.FromBase64String(cipherText), iv);
        }

        return Encoding.UTF8.GetString(decryptedText);
    }
}