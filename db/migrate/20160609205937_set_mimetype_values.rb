class SetMimetypeValues < ActiveRecord::Migration
  def self.up
    DsdLogEntry.update_all("mimetype=type")
  end

  def self.down
  end
end
