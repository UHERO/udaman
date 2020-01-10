class CreatePublicDataPoints < ActiveRecord::Migration
  def change
    create_table :public_data_points, id: false do |t|
      t.belongs_to :series
      t.date :date
      t.float :value, limit: 53

      t.timestamps null: false
    end
    execute <<-SQL
      ALTER TABLE public_data_points ADD PRIMARY KEY(`series_id`, `date`);
    SQL
  end
end
