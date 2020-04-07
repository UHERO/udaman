class CreatePackagerOutputs < ActiveRecord::Migration
  def self.up
    create_table :packager_outputs unless table_exists? :packager_outputs do |t|
      t.string :path
      t.date :last_new_data

      t.timestamps
    end
  end

  def self.down
    drop_table :packager_outputs if table_exists? :packager_outputs
  end
end
