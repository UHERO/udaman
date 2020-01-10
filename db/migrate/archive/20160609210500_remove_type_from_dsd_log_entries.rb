class RemoveTypeFromDsdLogEntries < ActiveRecord::Migration
  def change
    remove_column :dsd_log_entries, :type, :string
  end
end
