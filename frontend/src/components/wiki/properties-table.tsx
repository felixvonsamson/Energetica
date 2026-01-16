import { JSX } from "react";

interface Property {
    label: string;
    value: string | JSX.Element;
}

interface PropertiesTableProps {
    properties: Property[];
    headers?: { label: string; value: string };
}

export function PropertiesTable({ properties, headers }: PropertiesTableProps) {
    return (
        <div className="flex justify-center my-8">
            <div className="overflow-x-auto">
                <table className="w-auto">
                    {headers && (
                        <thead>
                            <tr>
                                <th className="text-left pr-8 py-2 font-semibold">
                                    {headers.label}
                                </th>
                                <th className="text-left py-2 font-semibold">
                                    {headers.value}
                                </th>
                            </tr>
                        </thead>
                    )}
                    <tbody>
                        {properties.map((property) => (
                            <tr key={property.label}>
                                <th className="text-left pr-8 py-2 font-semibold whitespace-nowrap">
                                    {property.label}
                                </th>
                                <td className="py-2">{property.value}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
