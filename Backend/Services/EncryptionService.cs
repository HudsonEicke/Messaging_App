using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using Messaging_App.Configuration;

namespace Messaging_App.Services;

public class EncryptionService
{
    private readonly byte[] key;
    
    public EncryptionService(IOptions<EncryptionSettings> encryptionSettings)
    {
        string secretKey = encryptionSettings.Value.SecretKey;
        key = SHA256.HashData(Encoding.UTF8.GetBytes(secretKey));
    }

    public string Encrypt(string plainText)
    {
        byte[] cipherBytes;
        byte[] iv;

        using(Aes aes = Aes.Create())
        {
            aes.Key = key;
            aes.GenerateIV();
            iv = aes.IV;

            cipherBytes = aes.EncryptCbc(Encoding.UTF8.GetBytes(plainText), iv);
        }

        byte[] result = new byte[iv.Length + cipherBytes.Length];
        iv.CopyTo(result, 0);
        cipherBytes.CopyTo(result, iv.Length);

        return Convert.ToBase64String(result);
    }

    public string Decrypt(string cipherText)
    {
        byte[] decryptedText;
        byte[] fullBytes = Convert.FromBase64String(cipherText);

        byte[] iv = new byte[16];
        byte[] cipherBytes = new byte[fullBytes.Length - 16];
        Array.Copy(fullBytes, 0, iv, 0, 16);
        Array.Copy(fullBytes, 16, cipherBytes, 0, cipherBytes.Length);

        using(Aes aes = Aes.Create())
        {
            aes.Key = key;
            aes.IV = iv;

            decryptedText = aes.DecryptCbc(cipherBytes, iv);
        }

        return Encoding.UTF8.GetString(decryptedText);
    }
}