class SetDefaultForSeriesDepDepth < ActiveRecord::Migration
  def change
    change_column_default :series, :dependency_depth, 0
  end
end
