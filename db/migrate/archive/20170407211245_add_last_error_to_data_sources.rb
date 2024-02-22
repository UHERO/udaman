class AddLastErrorToDataSources < ActiveRecord::Migration[5.2]
  def change
    add_column :data_sources, :last_error, :string, after: :last_run_in_seconds
    add_column :data_sources, :last_error_at, :datetime, after: :last_error
  end
end
