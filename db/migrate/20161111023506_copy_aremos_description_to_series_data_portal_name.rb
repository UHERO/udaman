class CopyAremosDescriptionToSeriesDataPortalName < ActiveRecord::Migration
  def up
    execute <<-SQL
      UPDATE series JOIN aremos_series ON series.name = aremos_series.name
      SET series.dataPortalName = tcase(LEFT(aremos_series.description, LENGTH(aremos_series.description) - LOCATE(',', REVERSE(aremos_series.description))))
      WHERE series.dataPortalName IS NULL;
    SQL
  end
end
