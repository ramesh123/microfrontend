import React from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';


interface TasksChartData {
  time: number;
  Completed: number;
  Failed: number;
}

const taskRunData: TasksChartData[] = [
  { time: 0, Completed: 0, Failed: 0 }, { time: 1, Completed: 0, Failed: 1 },
  { time: 2, Completed: 1, Failed: 1 }, { time: 3, Completed: 1, Failed: 2 },
  { time: 4, Completed: 2, Failed: 2 }, { time: 5, Completed: 2, Failed: 3 },
  { time: 6, Completed: 3, Failed: 3 }, { time: 7, Completed: 4, Failed: 4 },
  { time: 8, Completed: 5, Failed: 4 }, { time: 9, Completed: 5, Failed: 4 },
];

const totalCompleted = 5;
const totalFailed = 4;
const totalTasks = totalCompleted + totalFailed;
const completedPercentage = ((totalCompleted / totalTasks) * 100).toFixed(2);
const failedPercentage = ((totalFailed / totalTasks) * 100).toFixed(2);

const statusColors = {  
  Completed: 'hsl(141, 76%, 42%)',
  Failed: 'hsl(3, 87%, 62%)',
};

const CustomTooltip = ({ active, payload }: any) => {  
  if (active && payload && payload.length) {
    return (
      <div className="bg-background/80 backdrop-blur-sm border rounded-lg shadow-lg p-3">
        {payload.map((pld: any) => (
          <div key={pld.dataKey} className="flex items-center gap-2 text-sm py-1">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: pld.stroke }}></div>
            <span className="text-muted-foreground">{pld.dataKey}:</span>
            <span className="font-medium text-foreground">{pld.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export const TasksOverTimeChart: React.FC = () => {
  return (
    <Card className="p-0">
      <CardHeader className="p-2 pb-0">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-sm font-medium">Task Runs</CardTitle>
            <div className="text-2xl font-bold">{totalTasks}</div>
          </div>
          <div className="text-xs text-muted-foreground text-right space-y-1">
            <span>{totalCompleted} Completed {completedPercentage}%</span>
            <span>{totalFailed} Failed {failedPercentage}%</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 pb-1 pt-0">
        <div className='pb-2'>
        <ResponsiveContainer width="100%" height={118}>
          <AreaChart data={taskRunData} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={statusColors.Completed} stopOpacity={0.4}/>
                <stop offset="95%" stopColor={statusColors.Completed} stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={statusColors.Failed} stopOpacity={0.4}/>
                <stop offset="95%" stopColor={statusColors.Failed} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <Tooltip
              cursor={{ stroke: 'hsl(var(--foreground))', strokeWidth: 1, strokeDasharray: '3 3' }}
              content={<CustomTooltip />}
            />
            <Area 
                type="monotone" 
                dataKey="Completed" 
                stroke={statusColors.Completed} 
                strokeWidth={2.5} 
                fillOpacity={1} 
                fill="url(#colorCompleted)" 
            />
            <Area 
                type="monotone" 
                dataKey="Failed" 
                stroke={statusColors.Failed}
                strokeWidth={2.5} 
                fillOpacity={1} 
                fill="url(#colorFailed)" 
            />
          </AreaChart>
        </ResponsiveContainer>


        </div>
      </CardContent>
    </Card>
  );
};