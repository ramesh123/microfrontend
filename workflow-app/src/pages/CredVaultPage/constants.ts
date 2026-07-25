

export const mockCredentials = [
    {
      id: "1",
      name: "Production DB",
      cred_type: "PostgreSQL",
      cred_model: "postgres",
      credentials: {
        host: "prod-db.company.com",
        port: "5432",
        user_name: "admin",
        database_name: "main_db"
      },
      created_at: "2024-01-15T10:30:00Z",
      updated_at: "2024-01-20T15:45:00Z"
    },
    {
      id: "2",
      name: "Analytics MySQL",
      cred_type: "MySQL",
      cred_model: "mysql",
      credentials: {
        host: "analytics.internal.com",
        port: "3306",
        user_name: "analytics_user",
        database_name: "analytics_db"
      },
      created_at: "2024-01-10T09:15:00Z",
      updated_at: "2024-01-18T11:20:00Z"
    },
    {
      id: "3",
      name: "Staging Oracle",
      cred_type: "Oracle",
      cred_model: "oracle",
      credentials: {
        host: "staging-oracle.dev.com",
        port: "1521",
        user_name: "staging_user",
        database_name: "staging_db"
      },
      created_at: "2024-01-12T14:22:00Z",
      updated_at: "2024-01-19T16:33:00Z"
    },
    {
      id: "4",
      name: "Email Notifications",
      cred_type: "Email",
      cred_model: "smtp",
      credentials: {
        host: "smtp.company.com",
        port: "587",
        user_name: "notifications@company.com",
        database_name: "N/A"
      },
      created_at: "2024-01-08T12:00:00Z",
      updated_at: "2024-01-22T10:15:00Z"
    },
    {
      id: "5",
      name: "File Transfer SFTP",
      cred_type: "SFTP",
      cred_model: "sftp",
      credentials: {
        host: "files.company.com",
        port: "22",
        user_name: "file_transfer",
        database_name: "N/A"
      },
      created_at: "2024-01-05T08:45:00Z",
      updated_at: "2024-01-21T13:30:00Z"
    }
  ];
  
  export const connectorsData = {
    "notification": [
      {
        id: "email",
        name: "Email",
        icon: "Email",
        description: "Email notification service"
      }
    ],
    "files": [
      {
        id: "sftp",
        name: "SFTP",
        icon: "SFTP",
        description: "Secure File Transfer Protocol"
      },
      {
        id: "excel",
        name: "Ms Excel",
        icon: "Ms Excel",
        description: "Microsoft Excel files"
      },
      {
        id: "csv",
        name: "CSVFile",
        icon: "CSVFile",
        description: "Comma Separated Values files"
      },
      {
        id: "parquet",
        name: "ParquetFile",
        icon: "ParquetFile",
        description: "Apache Parquet files"
      },
      {
        id: "feather",
        name: "FeatherFile",
        icon: "FeatherFile",
        description: "Apache Feather files"
      },
      {
        id: "json",
        name: "JsonFile",
        icon: "JsonFile",
        description: "JSON files"
      }
    ],
    "databases": [
      {
        id: "mysql",
        name: "MySQL",
        icon: "MySQL",
        description: "MySQL database"
      },
      {
        id: "postgresql",
        name: "PostgreSQL",
        icon: "PostgreSQL",
        description: "PostgreSQL database"
      },
      {
        id: "s3",
        name: "s3",
        icon: "s3",
        description: "Amazon S3 storage"
      },
      {
        id: "elasticsearch",
        name: "ElasticSearch",
        icon: "ElasticSearch",
        description: "Elasticsearch search engine"
      },
      {
        id: "s4hana",
        name: "S4 Hana",
        icon: "S4 Hana",
        description: "SAP S/4HANA"
      },
      {
        id: "oracle",
        name: "Oracle",
        icon: "Oracle",
        description: "Oracle database"
      },
      {
        id: "salesforce",
        name: "Salesforce",
        icon: "Salesforce",
        description: "Salesforce CRM"
      },
      {
        id: "mssql",
        name: "MsSQL",
        icon: "MsSQL",
        description: "Microsoft SQL Server"
      }
    ]
  };

  export const formSchemas = {
    postgresql: {
      name: "postgresql",
      display_name: "PostgreSQL",
      group: "Databases",
      icon: "postgresql",
      description: "A robust enterprise-grade relational database management system used widely for transaction processing and data warehousing.",
      enabled: true,
      fields: [
        {
          type: "text",
          label: "Connection Name",
          name: "name",
          placeholder: "Connection name",
          required: true
        },
        {
          type: "text",
          label: "Host",
          name: "host",
          placeholder: "Enter the host",
          required: true
        },
        {
          type: "text",
          label: "Port",
          name: "port",
          placeholder: "Enter the port",
          required: true
        },
        {
          type: "text",
          label: "Username",
          name: "user_name",
          placeholder: "Enter the username",
          required: true
        },
        {
          type: "password",
          label: "Password",
          name: "password",
          placeholder: "Enter the password",
          required: true
        },
        {
          type: "text",
          label: "Database",
          name: "database_name",
          placeholder: "Enter the database"
        },
        {
          type: "select",
          label: "Database Type",
          name: "connection_type",
          options: [
            {
              label: "PostgreSQL",
              value: "postgres"
            }
          ],
          placeholder: "Select the database type",
          required: true
        },
        {
          type: "checkbox",
          label: "Is Active",
          name: "is_active",
          default: true
        },
        {
          type: "checkbox",
          label: "Use SSH Tunnel",
          name: "is_ssh_tunnel",
          default: false
        },
        {
          type: "text",
          label: "SSH Host",
          name: "ssh_tunnel.host",
          placeholder: "Enter the host",
          required: false,
          depends_on: ["is_ssh_tunnel"],
          visible: true,
          depends_value: true
        },
        {
          type: "text",
          label: "SSH Port",
          name: "ssh_tunnel.port",
          placeholder: "Enter the port",
          required: false,
          depends_on: ["is_ssh_tunnel"],
          visible: true,
          depends_value: true
        },
        {
          type: "text",
          label: "SSH Username",
          name: "ssh_tunnel.user_name",
          placeholder: "Enter the username",
          required: false,
          depends_on: ["is_ssh_tunnel"],
          visible: true,
          depends_value: true
        },
        {
          type: "password",
          label: "SSH Password",
          name: "ssh_tunnel.password",
          placeholder: "Enter the password",
          required: false,
          depends_on: ["is_ssh_tunnel"],
          visible: true,
          depends_value: true
        },
        {
          type: "upload",
          label: "SSH Private Key",
          name: "ssh_tunnel.private_key",
          placeholder: "Enter the private key",
          required: false,
          depends_on: ["is_ssh_tunnel"],
          visible: true,
          depends_value: true
        }
      ]
    },
    mysql: {
      name: "mysql",
      display_name: "MySQL",
      group: "Databases",
      icon: "mysql",
      description: "Popular open-source relational database management system.",
      enabled: true,
      fields: [
        {
          type: "text",
          label: "Connection Name",
          name: "name",
          placeholder: "Connection name",
          required: true
        },
        {
          type: "text",
          label: "Host",
          name: "host",
          placeholder: "Enter the host",
          required: true
        },
        {
          type: "text",
          label: "Port",
          name: "port",
          placeholder: "3306",
          required: true
        },
        {
          type: "text",
          label: "Username",
          name: "user_name",
          placeholder: "Enter the username",
          required: true
        },
        {
          type: "password",
          label: "Password",
          name: "password",
          placeholder: "Enter the password",
          required: true
        },
        {
          type: "text",
          label: "Database",
          name: "database_name",
          placeholder: "Enter the database"
        },
        {
          type: "checkbox",
          label: "Is Active",
          name: "is_active",
          default: true
        }
      ]
    },
    email: {
      name: "email",
      display_name: "Email",
      group: "Notification",
      icon: "email",
      description: "Email notification service configuration.",
      enabled: true,
      fields: [
        {
          type: "text",
          label: "Connection Name",
          name: "name",
          placeholder: "Email connection name",
          required: true
        },
        {
          type: "text",
          label: "SMTP Host",
          name: "host",
          placeholder: "smtp.gmail.com",
          required: true
        },
        {
          type: "text",
          label: "SMTP Port",
          name: "port",
          placeholder: "587",
          required: true
        },
        {
          type: "text",
          label: "Email Address",
          name: "user_name",
          placeholder: "your-email@domain.com",
          required: true
        },
        {
          type: "password",
          label: "Password",
          name: "password",
          placeholder: "Enter the password or app password",
          required: true
        },
        {
          type: "checkbox",
          label: "Use TLS",
          name: "use_tls",
          default: true
        },
        {
          type: "checkbox",
          label: "Is Active",
          name: "is_active",
          default: true
        }
      ]
    },
    sftp: {
      name: "sftp",
      display_name: "SFTP",
      group: "Files",
      icon: "sftp",
      description: "Secure File Transfer Protocol configuration.",
      enabled: true,
      fields: [
        {
          type: "text",
          label: "Connection Name",
          name: "name",
          placeholder: "SFTP connection name",
          required: true
        },
        {
          type: "text",
          label: "Host",
          name: "host",
          placeholder: "Enter the SFTP host",
          required: true
        },
        {
          type: "text",
          label: "Port",
          name: "port",
          placeholder: "22",
          required: true
        },
        {
          type: "text",
          label: "Username",
          name: "user_name",
          placeholder: "Enter the username",
          required: true
        },
        {
          type: "password",
          label: "Password",
          name: "password",
          placeholder: "Enter the password",
          required: false
        },
        {
          type: "upload",
          label: "Private Key",
          name: "private_key",
          placeholder: "Upload private key file",
          required: false
        },
        {
          type: "text",
          label: "Remote Path",
          name: "remote_path",
          placeholder: "/home/user/files",
          required: false
        },
        {
          type: "checkbox",
          label: "Is Active",
          name: "is_active",
          default: true
        }
      ]
    }
  };