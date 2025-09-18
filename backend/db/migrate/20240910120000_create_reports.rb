class CreateReports < ActiveRecord::Migration[6.1]
  def change
    create_table :reports do |t|
      t.references :jobber_account, null: false, foreign_key: true
      t.string :report_type, null: false
      t.jsonb :parameters
      t.integer :status, default: 0
      t.string :file_path
      t.text :error_message
      t.timestamps
    end
  end
end
