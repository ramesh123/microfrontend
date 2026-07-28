import React, { forwardRef, useMemo, type SVGProps } from "react";
import { cn } from "@/lib/utils";

import amqpSvg from "@/assets/images/amqp.svg?raw";
import bacnetSvg from "@/assets/images/bacnet.svg?raw";
import coapSvg from "@/assets/images/coap.svg?raw";
import databaseSvg from "@/assets/images/database.svg?raw";
import dnp3Svg from "@/assets/images/dnp3.svg?raw";
import ethernetIpSvg from "@/assets/images/ethernet_ip.svg?raw";
import hartIpSvg from "@/assets/images/hart_ip.svg?raw";
import iccpTase2Svg from "@/assets/images/iccp_tase2.svg?raw";
import iec104Svg from "@/assets/images/iec104.svg?raw";
import iec61850Svg from "@/assets/images/iec61850.svg?raw";
import modbusSvg from "@/assets/images/modbus.svg?raw";
import mqttSvg from "@/assets/images/mqtt.svg?raw";
import opcAeSvg from "@/assets/images/opc_ae.svg?raw";
import opcDaSvg from "@/assets/images/opc_da.svg?raw";
import opcHdaSvg from "@/assets/images/opc_hda.svg?raw";
import opcUaSvg from "@/assets/images/opc_ua.svg?raw";
import profinetSvg from "@/assets/images/profinet.svg?raw";
import serialSvg from "@/assets/images/serial.svg?raw";
import snmpSvg from "@/assets/images/snmp.svg?raw";

const DEFAULT_VIEWBOX = "0 0 64 64";

function parseSvgViewBox(raw: string): string {
  const match = raw.match(/viewBox\s*=\s*["']([^"']+)["']/i);
  return match?.[1]?.trim() ?? DEFAULT_VIEWBOX;
}

function svgInnerMarkup(raw: string): string {
  return raw
    .replace(/<\?xml[^?]*\?>\s*/i, "")
    .replace(/<svg[^>]*>/i, "")
    .replace(/<\/svg>\s*$/i, "")
    .trim();
}

type VaultIconProps = SVGProps<SVGSVGElement> & { size?: number };

function createVaultIcon(rawSvg: string, ariaLabel: string) {
  const viewBox = parseSvgViewBox(rawSvg);

  const Icon = forwardRef<SVGSVGElement, VaultIconProps>(
    ({ className, size: _size, ...props }, ref) => {
      const innerHtml = useMemo(() => svgInnerMarkup(rawSvg), []);

      return (
        <svg
          ref={ref}
          viewBox={viewBox}
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label={ariaLabel}
          preserveAspectRatio="xMidYMid meet"
          overflow="visible"
          className={cn("shrink-0 overflow-visible", className)}
          {...props}
          dangerouslySetInnerHTML={{ __html: innerHtml }}
        />
      );
    },
  );

  Icon.displayName = `${ariaLabel.replace(/\s+/g, "")}Icon`;
  return Icon;
}

export const AmqpIcon = createVaultIcon(amqpSvg, "AMQP");
export const BacnetIcon = createVaultIcon(bacnetSvg, "BACnet");
export const CoapIcon = createVaultIcon(coapSvg, "CoAP");
export const DatabaseIcon = createVaultIcon(databaseSvg, "Database");
export const Dnp3Icon = createVaultIcon(dnp3Svg, "DNP3");
export const EthernetIpIcon = createVaultIcon(ethernetIpSvg, "EtherNet/IP");
export const HartIpIcon = createVaultIcon(hartIpSvg, "HART-IP");
export const IccpTase2Icon = createVaultIcon(iccpTase2Svg, "ICCP TASE.2");
export const Iec104Icon = createVaultIcon(iec104Svg, "IEC 60870-5-104");
export const Iec61850Icon = createVaultIcon(iec61850Svg, "IEC 61850");
export const ModbusIcon = createVaultIcon(modbusSvg, "Modbus");
export const MqttIcon = createVaultIcon(mqttSvg, "MQTT");
export const OpcAeIcon = createVaultIcon(opcAeSvg, "OPC A&E");
export const OpcDaIcon = createVaultIcon(opcDaSvg, "OPC DA");
export const OpcHdaIcon = createVaultIcon(opcHdaSvg, "OPC HDA");
export const OpcUaIcon = createVaultIcon(opcUaSvg, "OPC UA");
export const ProfinetIcon = createVaultIcon(profinetSvg, "PROFINET");
export const SerialIcon = createVaultIcon(serialSvg, "Serial RS-485");
export const SnmpIcon = createVaultIcon(snmpSvg, "SNMP");

function wrapIcon(Icon: ReturnType<typeof createVaultIcon>, displayName: string) {
  const Component = forwardRef<SVGSVGElement, React.PropsWithChildren<{ className?: string }>>(
    (props, ref) => <Icon ref={ref} {...props} className={cn(props.className)} />,
  );
  Component.displayName = displayName;
  return Component;
}

export const AmqpIconComponent = wrapIcon(AmqpIcon, "AmqpIconComponent");
export const BacnetIconComponent = wrapIcon(BacnetIcon, "BacnetIconComponent");
export const CoapIconComponent = wrapIcon(CoapIcon, "CoapIconComponent");
export const DatabaseIconComponent = wrapIcon(DatabaseIcon, "DatabaseIconComponent");
export const Dnp3IconComponent = wrapIcon(Dnp3Icon, "Dnp3IconComponent");
export const EthernetIpIconComponent = wrapIcon(EthernetIpIcon, "EthernetIpIconComponent");
export const HartIpIconComponent = wrapIcon(HartIpIcon, "HartIpIconComponent");
export const IccpTase2IconComponent = wrapIcon(IccpTase2Icon, "IccpTase2IconComponent");
export const Iec104IconComponent = wrapIcon(Iec104Icon, "Iec104IconComponent");
export const Iec61850IconComponent = wrapIcon(Iec61850Icon, "Iec61850IconComponent");
export const ModbusIconComponent = wrapIcon(ModbusIcon, "ModbusIconComponent");
export const MqttIconComponent = wrapIcon(MqttIcon, "MqttIconComponent");
export const OpcAeIconComponent = wrapIcon(OpcAeIcon, "OpcAeIconComponent");
export const OpcDaIconComponent = wrapIcon(OpcDaIcon, "OpcDaIconComponent");
export const OpcHdaIconComponent = wrapIcon(OpcHdaIcon, "OpcHdaIconComponent");
export const OpcUaIconComponent = wrapIcon(OpcUaIcon, "OpcUaIconComponent");
export const ProfinetIconComponent = wrapIcon(ProfinetIcon, "ProfinetIconComponent");
export const SerialIconComponent = wrapIcon(SerialIcon, "SerialIconComponent");
export const SnmpIconComponent = wrapIcon(SnmpIcon, "SnmpIconComponent");
