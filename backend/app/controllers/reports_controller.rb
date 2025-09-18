# frozen_string_literal: true

class ReportsController < ApplicationController
  def create
    report = @jobber_account.reports.create!(report_params)
    ReportJob.perform_async(report.id)
    render json: { report: report.as_json(only: [:id, :status, :created_at]) }, status: :created
  end

  def show
    report = @jobber_account.reports.find(params[:id])
    render json: { report: report.as_json(only: [:id, :report_type, :status, :file_path, :created_at, :updated_at]) }
  end

  def index
    reports = @jobber_account.reports.order(created_at: :desc)
    render json: { reports: reports.as_json(only: [:id, :report_type, :status, :created_at]) }
  end

  private

  def report_params
    params.require(:report).permit(:report_type, :parameters)
  end
end
