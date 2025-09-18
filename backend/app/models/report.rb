# frozen_string_literal: true

class Report < ApplicationRecord
  belongs_to :jobber_account

  enum status: { pending: 0, processing: 1, completed: 2, failed: 3 }

  validates :report_type, presence: true

  # Add methods for generating report
end
