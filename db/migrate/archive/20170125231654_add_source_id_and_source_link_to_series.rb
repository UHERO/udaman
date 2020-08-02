class AddSourceIdAndSourceLinkToSeries < ActiveRecord::Migration
  def change
    add_reference :series, :source, foreign_key: true
    add_column :series, :source_link, :string
  end
end
