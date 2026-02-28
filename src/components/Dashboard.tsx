interface DashboardProps {
  stats: any
}

const upcomingCalls = [
  { name: 'Sarah Mitchell', time: 'Today, 2:30 PM' },
  { name: 'James Cooper', time: 'Today, 4:00 PM' },
  { name: 'Linda Nguyen', time: 'Tomorrow, 10:00 AM' },
]

const awaitingResponse = [
  'Mark Thompson',
  'Priya Sharma',
  'David Chen',
]

function Dashboard({ stats }: DashboardProps) {
  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-sm text-gray-500">Calls Coming Up</p>
          <p className="text-3xl font-bold text-primary-600">5</p>
          <ul className="mt-3 space-y-1">
            {upcomingCalls.map((call) => (
              <li key={call.name} className="text-xs text-gray-500 flex justify-between">
                <span className="font-medium text-gray-700">{call.name}</span>
                <span>{call.time}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Clients Awaiting Response</p>
          <p className="text-3xl font-bold text-amber-600">8</p>
          <ul className="mt-3 space-y-1">
            {awaitingResponse.map((name) => (
              <li key={name} className="text-xs text-gray-500">
                <span className="font-medium text-gray-700">{name}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Clients In Progress</p>
          <p className="text-3xl font-bold text-primary-600">12</p>
          <p className="text-xs text-gray-400 mt-3">Active pipeline</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Clients Converted</p>
          <p className="text-3xl font-bold text-green-600">34</p>
          <p className="text-xs text-gray-400 mt-3">Successful deals</p>
        </div>
      </div>

      {/* Analytics Section */}
      {stats && (
        <>
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Performance Analytics (Demo Data)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-500">Average Deal Size</p>
                <p className="text-2xl font-bold">${stats.avg_deal_size.toLocaleString()}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-500">Monthly Revenue</p>
                <p className="text-2xl font-bold">${stats.monthly_revenue.toLocaleString()}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-500">YTD Revenue</p>
                <p className="text-2xl font-bold">${stats.ytd_revenue.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">Deal Activity (Demo)</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Deals This Month</span>
                  <span className="font-semibold">{stats.deals_this_month}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Deals Last Month</span>
                  <span className="font-semibold">{stats.deals_last_month}</span>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 className="text-lg font-semibold mb-4">Top Performing Bank (Demo)</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Bank</span>
                  <span className="font-semibold">{stats.top_performing_bank}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Conversion Rate</span>
                  <span className="font-semibold text-green-600">{stats.top_bank_conversion}%</span>
                </div>
              </div>
              <p className="text-sm text-gray-400 mt-4">
                * Analytics will be populated with real data as you use the system
              </p>
            </div>
          </div>
        </>
      )}

      {/* Quick Actions */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="flex gap-4">
          <button className="btn-primary">Add New Client</button>
          <button className="btn-secondary">Start Recording</button>
          <button className="btn-secondary">Upload Document</button>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
