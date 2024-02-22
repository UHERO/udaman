class AddSourceIdAndSourceLinkToSeries < ActiveRecord::Migration[5.2]
  def change
    add_reference :series, :source, foreign_key: true
    add_column :series, :source_link, :string
  end
end
