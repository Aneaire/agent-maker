# PostgreSQL Connections

**Plan**: Pro+

Connect your agent to external PostgreSQL databases. Agents can query your data to answer questions, generate reports, and provide insights.

## Setup

1. Create a **PostgreSQL** page type for your agent
2. Enter your connection string
3. Test the connection
4. Your agent can now run read-only queries

## Connection String Format

```
postgresql://user:password@host:port/database
```

Or with SSL:
```
postgresql://user:password@host:port/database?sslmode=require
```

## Security

- Connections are read-only by default
- Connection strings are stored encrypted at rest
- The agent cannot modify data (SELECT only)
- Connection is tested and validated before saving

## Limits

| Limit | Free | Pro | Enterprise |
|-------|------|-----|------------|
| Connections | 0 | 1 | 5 |
