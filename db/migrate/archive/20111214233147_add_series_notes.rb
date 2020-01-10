class AddSeriesNotes < ActiveRecord::Migration
  def self.up
    add_column :series, :investigation_notes, :text unless column_exists? :series, :investigation_notes
  end

  def self.down
    remove_column :series, :investigation_notes if column_exists? :series, :investigation_notes
  end
end
