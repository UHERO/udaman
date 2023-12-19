class SetMimetypeValues < ActiveRecord::Migration[5.2]
  def self.up
    DsdLogEntry.update_all('mimetype=type')
  end

  def self.down
  end
end
