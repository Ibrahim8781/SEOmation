import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend
} from 'recharts';
import './analyticsWidget.css';

interface AnalyticsWidgetProps {
  data: Array<{
    label: string;
    reach: number;
    engagement: number;
  }>;
}

export function AnalyticsWidget({ data }: AnalyticsWidgetProps) {
  return (
    <div className="analytics-widget glass-card">
      <header>
        <h3>Analytics</h3>
        <span>Performance snapshot</span>
      </header>
      <div className="analytics-widget__chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(115, 122, 145, 0.2)" />
            <XAxis 
              dataKey="label" 
              stroke="rgba(115, 122, 145, 0.6)"
              tick={{ fontSize: 11 }}
            />
            <YAxis 
              stroke="rgba(115, 122, 145, 0.6)"
              tick={{ fontSize: 11 }}
            />
            <Tooltip 
              contentStyle={{ fontSize: '12px' }}
            />
            <Legend 
              wrapperStyle={{ fontSize: '11px' }}
            />
            <Line
              type="monotone"
              dataKey="reach"
              stroke="#2f54eb"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="Views"
            />
            <Line
              type="monotone"
              dataKey="engagement"
              stroke="#ff7a45"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="Likes, comments, shares"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}