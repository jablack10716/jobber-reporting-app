require 'webrick'
require 'json'

server = WEBrick::HTTPServer.new(
  Port: 3000,
  BindAddress: '0.0.0.0',
  DocumentRoot: nil
)

# Health endpoint
server.mount_proc '/api/health' do |req, res|
  res['Content-Type'] = 'application/json'
  res.body = { status: 'ok', message: 'Jobber Reporting API is running' }.to_json
end

# Reports endpoint
server.mount_proc '/api/reports' do |req, res|
  res['Content-Type'] = 'application/json'
  res.body = { reports: [], message: 'Reports endpoint working' }.to_json
end

# Root endpoint
server.mount_proc '/' do |req, res|
  res['Content-Type'] = 'application/json'
  res.body = { message: 'Jobber Reporting API', endpoints: ['/api/health', '/api/reports'] }.to_json
end

# Handle shutdown gracefully
trap 'INT' do
  server.shutdown
end

puts "WEBrick server starting on port 3000..."
server.start