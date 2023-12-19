class RemoveTypeFromDsdLogEntries < ActiveRecord::Migration[5.2]
  def change
    remove_column :dsd_log_entries, :type, :string
  end
end
