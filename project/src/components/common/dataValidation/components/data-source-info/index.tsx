import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Database, Table, Columns } from "lucide-react"
import useFlowStore from "@/stores/flowStore"

const DataSourceInfo = () => {
    const nodes = useFlowStore((state) => state.currentWorkflow?.data?.nodes)
    // const connectingData = useFlowStore((state) => state.connectingData)

    const getDataSourceStats = () => {
        let totalColumns = 0
        let totalRecords = 0
        let dataSources = 0

        // Count from nodes
        nodes.forEach((node: any) => {
            if (node.data?.columns) {
                totalColumns += node.data.columns.length
                dataSources += 1
            }
        })

        // Count from connecting data
        // connectingData.forEach((connection: any) => {
        //     if (connection.data?.columns) {
        //         totalColumns += connection.data.columns.length
        //         if (connection.data.data) {
        //             totalRecords += connection.data.data.length
        //         }
            // }
        // })

        return { totalColumns, totalRecords, dataSources }
    }

    const stats = getDataSourceStats()

    if (stats.dataSources === 0) {
        return null
    }

    return (
        <Card className="mb-4">
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Data Source Overview
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
                <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="flex items-center gap-1">
                            <Database className="h-3 w-3" />
                            {stats.dataSources} Source{stats.dataSources !== 1 ? "s" : ""}
                        </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="flex items-center gap-1">
                            <Columns className="h-3 w-3" />
                            {stats.totalColumns} Column{stats.totalColumns !== 1 ? "s" : ""}
                        </Badge>
                    </div>
                    {stats.totalRecords > 0 && (
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="flex items-center gap-1">
                                <Table className="h-3 w-3" />
                                {stats.totalRecords} Record{stats.totalRecords !== 1 ? "s" : ""}
                            </Badge>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

export default DataSourceInfo
