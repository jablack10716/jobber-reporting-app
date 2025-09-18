require 'sinatra'
require 'json'

set :port, 3000
set :bind, '0.0.0.0'

get '/api/health' do
  content_type :json
  { status: 'ok', message: 'Jobber Reporting API is running' }.to_json
end

get '/api/reports' do
  content_type :json
  { reports: [], message: 'Reports endpoint working' }.to_json
end

get '/' do
  content_type :json
  { message: 'Jobber Reporting API', endpoints: ['/api/health', '/api/reports'] }.to_json
end