class AddMimetypeToDsdLogEntries < ActiveRecord::Migration
  def change
    add_column :dsd_log_entries, :mimetype, :string
  end
end
