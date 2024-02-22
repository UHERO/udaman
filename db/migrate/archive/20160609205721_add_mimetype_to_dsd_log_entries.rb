class AddMimetypeToDsdLogEntries < ActiveRecord::Migration[5.2]
  def change
    add_column :dsd_log_entries, :mimetype, :string
  end
end
