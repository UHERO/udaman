class AddSourceDetailToSeries < ActiveRecord::Migration[5.2]
  def change
    add_reference :series, :source_detail, foreign_key: true
  end
end
