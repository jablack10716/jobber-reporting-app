# frozen_string_literal: true

class ReportJob
  include Sidekiq::Job
  include Graphql::Queries::Jobs

  def perform(report_id)
    report = Report.find(report_id)
    report.update!(status: :processing)

    begin
      data = fetch_data(report)
      file_path = generate_file(data, report)
      report.update!(status: :completed, file_path: file_path)
    rescue => e
      report.update!(status: :failed, error_message: e.message)
    end
  end

  private

  def fetch_data(report)
    token = report.jobber_account.jobber_access_token
    jobber_service = JobberService.new

    case report.report_type
    when 'clients'
      query = Graphql::Queries::Clients::ClientsQuery
      variables = { limit: 100, cursor: nil, filter: nil }
      data = jobber_service.execute_paginated_query(token, query, variables, ["clients"])
    when 'jobs'
      query = JobsQuery
      variables = jobs_variables.merge(limit: 100)
      data = jobber_service.execute_paginated_query(token, query, variables, ["jobs"])
    end

    data
  end

  def generate_file(data, report)
    require 'csv'
    file_path = "reports/report_#{report.id}.csv"
    CSV.open(Rails.root.join('public', file_path), 'w') do |csv|
      if report.report_type == 'clients'
        csv << ['ID', 'Name']
        data.each do |item|
          csv << [item['id'], item['name']]
        end
      elsif report.report_type == 'jobs'
        csv << ['ID', 'Title', 'Client Name', 'Status', 'Created At']
        data.each do |item|
          csv << [item['id'], item['title'], item['client']['name'], item['status'], item['createdAt']]
        end
      end
    end
    file_path
  end
end
