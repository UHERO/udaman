class CreateRawData < ActiveRecord::Migration
  def change
    create_table :raw_data, id: false do |t|
      t.string :save_path
      t.string :options
      t.string :checksum

      t.timestamps null: false
    end
    execute <<-SQL
      ALTER TABLE raw_data ADD PRIMARY KEY(`series_id`, `date`);
    SQL
  end
end

