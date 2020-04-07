class ChangeCatsDataListIdToForeignKey < ActiveRecord::Migration
  def self.up
    execute <<~SQL
     ALTER TABLE categories
     ADD CONSTRAINT fk_rails_cats_data_list_id
     FOREIGN KEY (data_list_id) REFERENCES data_lists(id)
    SQL
  end
  def self.down
  end
end
