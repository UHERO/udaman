class AddSourceDetailToSeries < ActiveRecord::Migration
  def change
    add_reference :series, :source_detail, foreign_key: true
  end
end
