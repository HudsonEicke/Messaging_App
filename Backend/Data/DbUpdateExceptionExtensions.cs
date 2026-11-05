using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Messaging_App.Data;

public static class DbUpdateExceptionExtensions
{
    //true when the save failed because it broke a unique constraint, optionally a specific one by name
    public static bool IsUniqueViolation(this DbUpdateException exception, string? constraintName = null)
    {
        return exception.InnerException is PostgresException postgresException && postgresException.SqlState == PostgresErrorCodes.UniqueViolation && (constraintName == null || postgresException.ConstraintName == constraintName);
    }
}
