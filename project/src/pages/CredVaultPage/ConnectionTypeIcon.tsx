import { cn } from "@/lib/utils";
import { AmazonS3Icon } from "@/icons/AmazonS3/amazons3-icon";
import { MinioIcon } from "@/icons/MinIO/minio-icon";
import images from "./images";
import { normalizeConnectorIconId, resolveConnectorImagesKey } from "./connectorIconResolve";

const CONNECTION_TYPE_IMAGE_KEYS: Record<string, string> = {
  email: "Email",
  sftp: "SFTP",
  postgresql: "PostgreSQL",
  postgres: "PostgreSQL",
  mysql: "MySQL",
  oracle: "Oracle",
  mssql: "MsSQL",
  s4hana: "S4 Hana",
  sap: "S4 Hana",
  salesforce: "Salesforce",
  amazon_s3: "Amazon S3",
  "amazon s3": "Amazon S3",
  elasticsearch: "ElasticSearch",
  dynamodb: "DynamoDB",
  redis: "Redis",
  mongodb: "MongoDB",
  influxdb: "InfluxDB",
  trino: "Trino",
  signvio: "Signvio",
  sign_vio: "Signvio",
  signavio: "Signavio",
  csv: "CSVFile",
  excel: "Ms Excel",
  parquet: "ParquetFile",
  feather: "FeatherFile",
  json: "JsonFile",
  slack: "Slack",
  sendgrid: "Sendgrid",
  teams: "Teams",
  amqp: "AMQP",
  bacnet: "BACnet",
  coap: "CoAP",
  database: "Database",
  dnp3: "DNP3",
  ethernet_ip: "EtherNet/IP",
  hart_ip: "HART-IP",
  iccp_tase2: "ICCP TASE.2",
  iec104: "IEC 60870-5-104",
  iec61850: "IEC 61850",
  modbus: "Modbus",
  mqtt: "MQTT",
  opc_ae: "OPC A&E",
  opc_da: "OPC DA",
  opc_hda: "OPC HDA",
  opc_ua: "OPC UA",
  profinet: "PROFINET",
  serial: "Serial RS-485",
  snmp: "SNMP",
  aws_lambda: "AWS Lambda",
  lambda: "AWS Lambda",
  databricks_lakehouse: "Databricks Lakehouse",
  databricks: "Databricks Lakehouse",
  blob_storage: "Blob Storage",
};

function isAmazonS3ConnectionType(connectionType: string | undefined): boolean {
  if (!connectionType) return false;
  const t = connectionType.toLowerCase().trim();
  return t === "s3" || t === "amazon_s3" || t === "amazon s3";
}

function isMinioConnectionType(connectionType: string | undefined): boolean {
  if (!connectionType) return false;
  const t = connectionType.toLowerCase().trim();
  return t === "minio" || t === "min_io";
}

export function getConnectionTypeImageSrc(
  connectionType: string | undefined,
): string | undefined {
  if (!connectionType?.trim()) return undefined;
  const id = normalizeConnectorIconId(connectionType);
  const mappedKey =
    CONNECTION_TYPE_IMAGE_KEYS[id] ?? resolveConnectorImagesKey(connectionType);
  return mappedKey ? images[mappedKey] : undefined;
}

type ConnectionTypeIconProps = {
  connectionType: string | undefined;
  className?: string;
};

export function ConnectionTypeIcon({
  connectionType,
  className = "h-6 w-6",
}: ConnectionTypeIconProps) {
  if (!connectionType?.trim()) return null;

  if (isAmazonS3ConnectionType(connectionType)) {
    return <AmazonS3Icon className={cn("shrink-0", className)} aria-hidden />;
  }

  if (isMinioConnectionType(connectionType)) {
    return <MinioIcon className={cn("shrink-0", className)} aria-hidden />;
  }

  const src = getConnectionTypeImageSrc(connectionType);
  if (!src) return null;

  return (
    <img
      src={src}
      alt={`${connectionType} icon`}
      className={cn("shrink-0 object-contain", className)}
    />
  );
}
