class CreatePublicDataPoints < ActiveRecord::Migration
  def change
    create_table :exports do |t|
      t.belongs_to :series, index: true
      t.belongs_to :data_source, index: true
      t.date :date
      t.double :value

      t.timestamps null: false
    end
  end
end
