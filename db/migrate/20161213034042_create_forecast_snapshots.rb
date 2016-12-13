class CreateForecastSnapshots < ActiveRecord::Migration
  def change
    create_table :forecast_snapshots do |t|
      t.string :name
      t.string :version
      t.text :comments
      t.boolean :published

      t.timestamps null: false
    end
  end
end
