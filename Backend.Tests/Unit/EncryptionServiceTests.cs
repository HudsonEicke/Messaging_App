using System.Security.Cryptography;
using Messaging_App.Configuration;
using Messaging_App.Services;
using Microsoft.Extensions.Options;

namespace Backend.Tests.Unit;

public class EncryptionServiceTests
{
    private readonly EncryptionService encryptionService;

    public EncryptionServiceTests()
    {
        IOptions<EncryptionSettings> settings = Options.Create(new EncryptionSettings{SecretKey = "test-encryption-key-32-chars-min"});

        this.encryptionService = new EncryptionService(settings);
    }

    [Fact]
    public void Decrypt_WithValidCipherText_ReturnsOriginalPlainText()
    {
        //arrange
        string original = "Hello, unit testing!";

        //act
        string encrypted = encryptionService.Encrypt(original);
        string decrypted = encryptionService.Decrypt(encrypted);

        //assert
        Assert.Equal(original, decrypted);
    }

    [Fact]
    public void Encrypt_SamePlainTextTwice_ReturnsDifferentCipherText()
    {
        //arrange
        string original = "Hello, unit testing!";

        //act
        string encrypted1 = encryptionService.Encrypt(original);
        string encrypted2 = encryptionService.Encrypt(original);

        //assert
        Assert.NotEqual(encrypted1, encrypted2);
    }

    [Fact]
    public void Encrypt_WithValidInput_ReturnsBase64String()
    {
        //arrange
        string plainText = "Hello, unit testing!";
    
        //act
        string encrypted = encryptionService.Encrypt(plainText);
        byte[] bytes = Convert.FromBase64String(encrypted);

        //assert
        Assert.NotEmpty(bytes);
    }

    [Fact]
    public void Decrypt_WithInvalidBase64_ThrowsFormatException()
    {
        //arrange
        string invalidCipherText = "Not a valid base64 string!";

        //act
        Exception? exception = Record.Exception(() => encryptionService.Decrypt(invalidCipherText));

        //assert
        Assert.IsType<FormatException>(exception);
    }

    [Fact]
    public void Decrypt_WithTamperedCipherText_ThrowsCryptographicException()
    {
        //arrange
        string original = "Hello, unit testing!";
        string encrypted = encryptionService.Encrypt(original);

        byte[] fullBytes = Convert.FromBase64String(encrypted);
        fullBytes[fullBytes.Length - 1] ^= 0xFF;
        string tampered = Convert.ToBase64String(fullBytes);

        //act
        Exception? exception = Record.Exception(() => encryptionService.Decrypt(tampered));

        //assert
        Assert.IsType<CryptographicException>(exception);
    }
}